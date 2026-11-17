import subprocess
import base64
import sys
from pathlib import Path

def fetch_file(remote_b64_file: str, local_dst: Path):
    print(f"Fetching {remote_b64_file} -> {local_dst}...")
    cmd = ["colab", "exec", "-s", "capstone-gpu"]
    code = f'with open("{remote_b64_file}", "r") as f: print(f.read())\n'
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(input=code)

    b64_str = "".join(stdout.splitlines()).strip()
    if not b64_str:
        print(f"Error fetching {remote_b64_file}: {stderr}")
        return False
    
    data = base64.b64decode(b64_str)
    local_dst.parent.mkdir(parents=True, exist_ok=True)
    with open(local_dst, "wb") as f:
        f.write(data)
    print(f"Saved {local_dst} ({len(data)} bytes, {len(data)/(1024*1024):.2f} MB)")
    return True

if __name__ == "__main__":
    models_dir = Path(r"c:\Users\frank\Projects\novo\models")
    fetch_file("/content/best_pt.b64", models_dir / "best_7seg_yolo.pt")
    fetch_file("/content/best_onnx.b64", models_dir / "best_7seg_yolo.onnx")
