import os
import re
import sys

def get_all_ts_files(root_dir):
    ts_files = []
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx')) and not file.endswith('.d.ts'):
                full_path = os.path.join(root, file)
                ts_files.append(os.path.abspath(full_path))
    return ts_files

def get_imports_from_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []
    
    imports = []
    # 1. import/export ... from '...'
    found = re.findall(r'(?:import|export)\s+(?:[\w\s{},*]+)\s+from\s+[\'"]([^\'"]+)[\'"]', content, re.DOTALL)
    imports.extend(found)
    
    # 2. import '...'
    found_side_effects = re.findall(r'^\s*import\s+[\'"]([^\'"]+)[\'"]', content, re.MULTILINE)
    imports.extend(found_side_effects)
    
    # 3. dynamic import
    imports.extend(re.findall(r'import\(\s*[\'"]([^\'"]+)[\'"]\s*\)', content))

    return [i for i in imports if i.startswith('.')]

def resolve_import(import_path, current_file_path):
    current_dir = os.path.dirname(current_file_path)
    
    try:
        target_path = os.path.normpath(os.path.join(current_dir, import_path))
    except ValueError:
        return []

    candidates = []
    
    # If import has explicit extension, check that first
    if os.path.isfile(target_path):
        candidates.append(target_path)
        return candidates

    # Possible extensions
    extensions = ['.ts', '.tsx', '.d.ts', '.js', '.jsx']
    
    # Case 1: Append extension
    for ext in extensions:
        candidates.append(target_path + ext)
        
    # Case 2: Directory index
    for ext in extensions:
        candidates.append(os.path.join(target_path, 'index' + ext))
        
    return candidates

def analyze_unused_files(src_dir):
    all_files = set(get_all_ts_files(src_dir))
    used_files = set()
    
    # Entry points that are always "used"
    entry_points = [
        'src/main.tsx', 
        'src/vite-env.d.ts',
        'src/App.tsx'
    ]
    
    # Add entry points to used_files if they exist
    for ep in entry_points:
        abs_ep = os.path.abspath(ep)
        if abs_ep in all_files:
            used_files.add(abs_ep)

    queue = list(used_files)
    visited = set(queue)
    
    while queue:
        current_file = queue.pop(0)
        
        imports = get_imports_from_file(current_file)
        for imp in imports:
            possible_paths = resolve_import(imp, current_file)
            for path in possible_paths:
                # Check if path is in our list of source files
                if path in all_files and path not in visited:
                    visited.add(path)
                    used_files.add(path)
                    queue.append(path)
    
    unused = all_files - used_files
    return unused

if __name__ == "__main__":
    unused_files = analyze_unused_files('src')
    print(f"Found {len(unused_files)} potentially unused files (not reachable from main.tsx/App.tsx):")
    for f in sorted(unused_files):
        print(os.path.relpath(f, os.getcwd()))




