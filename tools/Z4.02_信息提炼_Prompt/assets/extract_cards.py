import re
import os

def extract_cards(input_file, output_dir):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    cards = []
    current_card = None
    
    for i, line in enumerate(lines, 1):
        card_match = re.match(r'^\[\[([^\]]+)\]\]$', line.strip())
        if card_match:
            if current_card:
                cards.append(current_card)
            card_name = card_match.group(1)
            current_card = {
                'name': card_name,
                'filename': f"{card_name}.md",
                'start_line': i,
                'end_line': i,
                'content': []
            }
        elif current_card:
            line_stripped = line.strip()
            if line_stripped.startswith('- **'):
                current_card['content'].append(line)
                current_card['end_line'] = i
            elif line_stripped.startswith('---') or line_stripped.startswith('###') or line_stripped.startswith('**下一批次') or line_stripped.startswith('这是**') or line_stripped.startswith('这一部分') or line_stripped.startswith('接下来的') or line_stripped.startswith('这一批次') or line_stripped.startswith('核心逻辑') or line_stripped.startswith('1.') or line_stripped.startswith('2.') or line_stripped.startswith('3.') or line_stripped.startswith('4.'):
                cards.append(current_card)
                current_card = None
            elif re.match(r'^\[\[', line_stripped):
                cards.append(current_card)
                card_name = re.match(r'^\[\[([^\]]+)\]\]$', line_stripped).group(1)
                current_card = {
                    'name': card_name,
                    'filename': f"{card_name}.md",
                    'start_line': i,
                    'end_line': i,
                    'content': []
                }
            else:
                current_card['content'].append(line)
                current_card['end_line'] = i
    
    if current_card:
        cards.append(current_card)
    
    os.makedirs(output_dir, exist_ok=True)
    
    for card in cards:
        card_content = '\n'.join(card['content'])
        output_path = os.path.join(output_dir, card['filename'])
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(card_content)
        print(f"Created: {card['filename']} (Lines {card['start_line']}-{card['end_line']})")
    
    print(f"\nTotal cards extracted: {len(cards)}")
    print(f"Output directory: {output_dir}")

if __name__ == "__main__":
    input_file = r"c:\Users\x\Desktop\test\manuscript.md"
    output_dir = r"c:\Users\x\Desktop\test\cards"
    extract_cards(input_file, output_dir)
