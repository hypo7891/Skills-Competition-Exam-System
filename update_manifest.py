import os
import json
import codecs

# Set directory to questions folder
questions_dir = os.path.join(os.getcwd(), 'questions')
manifest_path = os.path.join(questions_dir, 'manifest.json')

def update_manifest():
    # Ensure questions dir exists
    if not os.path.exists(questions_dir):
        print(f"Error: Directory '{questions_dir}' not found.")
        return

    # List all files
    files = []
    try:
        for f in os.listdir(questions_dir):
            if f.endswith('.json') and f != 'manifest.json':
                files.append(f)
        
        # Sort files for consistent order
        files.sort()

        # Write to manifest.json
        with codecs.open(manifest_path, 'w', 'utf-8') as f:
            json.dump(files, f, ensure_ascii=False, indent=4)
        
        print(f"Successfully updated manifest.json with {len(files)} files:")
        for file in files:
            print(f" - {file}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    update_manifest()
