import re
import argparse
import sys
from typing import List, Optional
import pysrt  # 需要安装：pip install pysrt

def srt_to_text_with_punctuation(srt_file_path: str, 
                                output_file_path: Optional[str] = None,
                                language: str = 'zh') -> str:
    """
    将SRT字幕文件转换为带有标点符号的文本
    """
    
    def add_punctuation_to_sentence(sentence: str, lang: str = 'zh') -> str:
        sentence = sentence.strip()
        if not sentence:
            return ""
        
        if sentence and sentence[-1] in '。？！.!?…':
            return sentence
        
        if lang == 'zh':
            question_words = ['吗', '么', '呢', '何', '谁', '哪', '几', '多少', 
                            '什么', '为什么', '怎么', '难道', '是否']
            if any(word in sentence for word in question_words):
                return sentence + '？'
            exclamation_words = ['啊', '呀', '哇', '啦', '呢']
            if any(sentence.endswith(word) for word in exclamation_words) or '!' in sentence:
                return sentence + '！'
            return sentence + '。'
        else:
            if sentence and sentence[-1] not in '.!?':
                if sentence.lower().startswith(('what', 'why', 'how', 'when', 
                                              'where', 'who', 'which', 'is', 
                                              'are', 'do', 'does', 'can', 
                                              'could', 'would', 'will')):
                    return sentence + '?'
                elif sentence.upper() == sentence or '!' in sentence:
                    return sentence + '!'
                else:
                    return sentence + '.'
            return sentence
    
    def combine_consecutive_subtitles(subs: List[str], lang: str = 'zh') -> List[str]:
        combined = []
        current_sentence = ""
        for i, line in enumerate(subs):
            line = line.strip()
            if not line: continue
            if not current_sentence:
                current_sentence = line
            else:
                last_char = current_sentence[-1] if current_sentence else ''
                if lang == 'zh':
                    if (last_char in '，、；' or (len(line) < 4 and not any(mark in line for mark in '。？！.!?'))):
                        current_sentence += line
                    else:
                        combined.append(current_sentence)
                        current_sentence = line
                else:
                    if (last_char == ',' or (line and line[0].islower())):
                        current_sentence += ' ' + line
                    else:
                        combined.append(current_sentence)
                        current_sentence = line
        if current_sentence:
            combined.append(current_sentence)
        return combined

    try:
        # 尝试读取
        try:
            subs = pysrt.open(srt_file_path, encoding='utf-8')
            subtitles = [sub.text.replace('\n', ' ') for sub in subs]
        except Exception:
            with open(srt_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            pattern = r'\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n(.+?)\n\n'
            subtitles = re.findall(pattern, content + '\n\n', re.DOTALL)

        combined_subs = combine_consecutive_subtitles(subtitles, language)
        sentences_with_punct = [add_punctuation_to_sentence(re.sub(r'\s+', ' ', s).strip(), language) for s in combined_subs if s.strip()]
        
        final_text = ('\n' if language == 'zh' else ' ').join(sentences_with_punct)
        
        if output_file_path:
            with open(output_file_path, 'w', encoding='utf-8') as f:
                f.write(final_text)
        return final_text
    except Exception as e:
        print(f"错误: {e}")
        return ""

# --- 新增命令行处理部分 ---
def main():
    parser = argparse.ArgumentParser(description="SRT 字幕转文本工具：自动合并句子并添加标点")
    
    # 必需参数：输入文件
    parser.add_argument("input", help="输入的 SRT 文件路径")
    
    # 可选参数：输出文件
    parser.add_argument("-o", "--output", help="输出的文本文件路径 (默认与输入文件同名但后缀为 .txt)")
    
    # 可选参数：语言
    parser.add_argument("-l", "--lang", choices=['zh', 'en'], default='zh', 
                        help="语言类型：zh (中文，默认) 或 en (英文)")

    args = parser.parse_args()

    # 逻辑：如果没有指定输出路径，则自动生成
    input_path = args.input
    output_path = args.output
    
    if not output_path:
        if '.' in input_path:
            output_path = input_path.rsplit('.', 1)[0] + ".txt"
        else:
            output_path = input_path + ".txt"

    print(f"[*] 正在处理: {input_path}")
    print(f"[*] 识别语言: {args.lang}")
    
    result = srt_to_text_with_punctuation(input_path, output_path, language=args.lang)
    
    if result:
        print(f"[+] 转换成功！已保存至: {output_path}")
    else:
        print(f"[-] 转换失败，请检查输入文件。")

if __name__ == "__main__":
    main()