import shutil
import urllib.request
import zipfile
from pathlib import Path

REPOS = {
    "manu_panel": {
        "url": "https://github.com/Manu5643/smart-meter-reading-detection",
        "preferred_weights": ["best.pt"],
        "target_name": "manu_panel_best.pt",
    },
    "liamm_7seg": {
        "url": "https://github.com/liamm545/7Segement_YOLO",
        "preferred_weights": ["best_4.pt", "best.pt"],
        "target_name": "liamm_7seg_best.pt",
    },
}

BASE_DIR = Path(__file__).resolve().parent
REPOS_DIR = BASE_DIR / "repos"
MODELS_DIR = BASE_DIR / "models"
SAMPLES_DIR = BASE_DIR / "sample_images"


def download_repo_zip(repo_url: str, dest_dir: Path) -> Path:
    """Download and extract a GitHub repo archive (tries 'main' then 'master')."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    zip_path = dest_dir / "repo.zip"

    for branch in ("main", "master"):
        archive_url = f"{repo_url.rstrip('/')}/archive/refs/heads/{branch}.zip"
        try:
            print(f"Downloading {archive_url} ...")
            urllib.request.urlretrieve(archive_url, zip_path)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(dest_dir)
            zip_path.unlink(missing_ok=True)
            return dest_dir
        except Exception as e:
            print(f"  Branch '{branch}' unavailable ({e}), trying next...")

    raise RuntimeError(f"Could not download repository: {repo_url}")


def main():
    REPOS_DIR.mkdir(exist_ok=True)
    MODELS_DIR.mkdir(exist_ok=True)
    SAMPLES_DIR.mkdir(exist_ok=True)

    for key, cfg in REPOS.items():
        extracted_root = download_repo_zip(cfg["url"], REPOS_DIR / key)

        pt_files = list(extracted_root.rglob("*.pt"))
        print(f"Found weights in {key}: {[p.name for p in pt_files]}")

        selected = None
        for pref in cfg["preferred_weights"]:
            for p in pt_files:
                if p.name.lower() == pref.lower():
                    selected = p
                    break
            if selected:
                break

        if not selected and pt_files:
            selected = pt_files[0]

        if selected:
            target_path = MODELS_DIR / cfg["target_name"]
            shutil.copy2(selected, target_path)
            print(f"  -> Saved {selected.name} to {target_path}\n")
        else:
            print(f"  [WARNING] No .pt file found inside {cfg['url']}\n")

        for ext in ("*.jpg", "*.jpeg", "*.png"):
            for img in extracted_root.rglob(ext):
                if "runs" not in img.parts:
                    shutil.copy2(img, SAMPLES_DIR / f"{key}_{img.name}")

    if not any(SAMPLES_DIR.iterdir()):
        print("Fetching 5 sample meter images from HuggingFace...")
        try:
            from huggingface_hub import HfApi, hf_hub_download

            repo_id = "utilitimetersai/Annotated-LCD-Utility-Meter-Dials-Dataset"
            api = HfApi()
            files = [
                f for f in api.list_repo_files(repo_id=repo_id, repo_type="dataset")
                if f.lower().endswith((".jpg", ".jpeg", ".png"))
            ][:5]
            for f in files:
                local_file = hf_hub_download(
                    repo_id=repo_id, filename=f, repo_type="dataset", local_dir=SAMPLES_DIR
                )
                print(f"  -> Downloaded sample: {local_file}")
        except Exception as e:
            print(f"  HuggingFace sample fetch skipped: {e}")

    print("\nSetup complete. Weights are ready in C:\\Users\\frank\\Projects\\novo\\models\\")


if __name__ == "__main__":
    main()
