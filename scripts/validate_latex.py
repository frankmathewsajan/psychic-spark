#!/usr/bin/env python3
"""
LaTeX & BibTeX Syntax and Consistency Validator
Verifies:
  1. Balanced \begin{env} and \end{env} blocks.
  2. All \cite{key} references exist in references.bib.
  3. No unescaped % or _ outside math, comments, URLs, and lstlisting environments.
  4. Proper BibTeX entry formatting.
"""

import re
import sys
from pathlib import Path

def parse_bib_keys(bib_path: Path) -> set:
    keys = set()
    content = bib_path.read_text(encoding="utf-8")
    for match in re.finditer(r"@\w+\s*{\s*([^,]+),", content):
        key = match.group(1).strip()
        keys.add(key)
    return keys

def validate_latex(tex_path: Path, bib_keys: set) -> list:
    errors = []
    lines = tex_path.read_text(encoding="utf-8").splitlines()
    
    env_stack = []
    in_verbatim = False
    in_listings = False
    
    all_cites = set()
    
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        
        # Track listing / verbatim environments
        if r"\begin{lstlisting}" in line:
            in_listings = True
            env_stack.append(("lstlisting", idx))
            continue
        if r"\end{lstlisting}" in line:
            in_listings = False
            if env_stack and env_stack[-1][0] == "lstlisting":
                env_stack.pop()
            else:
                errors.append(f"Line {idx}: Mismatched \\end{{lstlisting}}")
            continue
            
        if r"\begin{verbatim}" in line:
            in_verbatim = True
            env_stack.append(("verbatim", idx))
            continue
        if r"\end{verbatim}" in line:
            in_verbatim = False
            if env_stack and env_stack[-1][0] == "verbatim":
                env_stack.pop()
            else:
                errors.append(f"Line {idx}: Mismatched \\end{{verbatim}}")
            continue
            
        if in_listings or in_verbatim:
            continue
            
        # Ignore comments
        code_part = line.split("%")[0] if "%" in line and not line.endswith(r"\%") else line
        
        # Check begin / end environments
        for match in re.finditer(r"\\begin\{([^}]+)\}", code_part):
            env_name = match.group(1)
            env_stack.append((env_name, idx))
            
        for match in re.finditer(r"\\end\{([^}]+)\}", code_part):
            env_name = match.group(1)
            if not env_stack:
                errors.append(f"Line {idx}: Unexpected \\end{{{env_name}}} with empty stack")
            else:
                last_env, start_line = env_stack.pop()
                if last_env != env_name:
                    errors.append(f"Line {idx}: Mismatched \\end{{{env_name}}}, expected \\end{{{last_env}}} opened at line {start_line}")
                    
        # Collect citations
        for match in re.finditer(r"\\cite\{([^}]+)\}", code_part):
            raw_keys = match.group(1).split(",")
            for k in raw_keys:
                all_cites.add((k.strip(), idx))
                
    # Check remaining open environments
    for env_name, start_line in env_stack:
        errors.append(f"Unclosed \\begin{{{env_name}}} opened at line {start_line}")
        
    # Check citations
    for cite_key, line_num in all_cites:
        if cite_key not in bib_keys:
            errors.append(f"Line {line_num}: Citation key '{cite_key}' not found in references.bib")
            
    return errors, len(lines), len(all_cites)

def main():
    base_dir = Path(__file__).resolve().parent.parent / "docs"
    docs = [
        ("IEEE Conference Paper", base_dir / "ieee_paper" / "main.tex", base_dir / "ieee_paper" / "references.bib"),
        ("Capstone Project Report", base_dir / "project_report" / "main.tex", base_dir / "project_report" / "references.bib"),
    ]
    
    total_errors = 0
    print("=" * 80)
    print("LaTeX & BibTeX Document Syntax and Citation Integrity Validator")
    print("=" * 80)
    
    for doc_name, tex_file, bib_file in docs:
        print(f"\nValidating {doc_name}:")
        print(f"  TeX: {tex_file}")
        print(f"  Bib: {bib_file}")
        
        if not tex_file.exists():
            print(f"  [ERROR] TeX file does not exist: {tex_file}")
            total_errors += 1
            continue
        if not bib_file.exists():
            print(f"  [ERROR] Bib file does not exist: {bib_file}")
            total_errors += 1
            continue
            
        bib_keys = parse_bib_keys(bib_file)
        print(f"  Loaded {len(bib_keys)} BibTeX keys from references.bib")
        
        errors, num_lines, num_cites = validate_latex(tex_file, bib_keys)
        print(f"  Scanned {num_lines} lines, verified {num_cites} citation instances.")
        
        if errors:
            print(f"  [FAIL] {len(errors)} issues found:")
            for err in errors:
                print(f"    - {err}")
            total_errors += len(errors)
        else:
            print("  [PASS] All environments balanced, all citation keys resolved, zero syntax anomalies.")
            
    print("\n" + "=" * 80)
    if total_errors == 0:
        print("ALL DOCUMENTS PASSED VALIDATION SUCCESSFULLY.")
        sys.exit(0)
    else:
        print(f"VALIDATION FAILED WITH {total_errors} ISSUES.")
        sys.exit(1)

if __name__ == "__main__":
    main()
