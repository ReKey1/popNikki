// PostToolUse hook: format the file Claude just wrote with the project's Prettier config.
import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as prettier from 'prettier'

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path

if (file && !path.relative(projectDir, file).startsWith('..')) {
  try {
    const ignorePath = ['.gitignore', '.prettierignore'].map((f) => path.join(projectDir, f))
    const { ignored, inferredParser } = await prettier.getFileInfo(file, { ignorePath })
    if (!ignored && inferredParser) {
      const source = await readFile(file, 'utf8')
      const options = await prettier.resolveConfig(file)
      const formatted = await prettier.format(source, { ...options, filepath: file })
      if (formatted !== source) await writeFile(file, formatted)
    }
  } catch {
    // Unparseable mid-edit files are left for lint/CI to report.
  }
}
