const vscode = require('vscode')
const fs = require('fs')
const path = require('path')

const { commands: vscCommands } = vscode
const { showErrorMessage, showInputBox, showInformationMessage, activeTextEditor } = vscode.window

function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const sep = path.sep
  const initDir = path.isAbsolute(targetDir) ? sep : ''
  const baseDir = isRelativeToScript ? __dirname : '.'

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir)
    try {
      fs.mkdirSync(curDir)
    } catch (err) {
      if (err.code === 'EEXIST') {
        return curDir
      }
      if (err.code === 'ENOENT') {
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`)
      }
      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1
      if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
        throw err
      }
    }
    return curDir
  }, initDir)
}

function activate(context) {
  async function executor(ctx, stateful) {
    let name = await showInputBox({ prompt: 'New component name' })
    if (!name) {
      return showErrorMessage('Create Component Failed')
    }
    let filePath
    if (ctx) {
      filePath = ctx.fsPath
    } else {
      let suggestion = activeTextEditor ? path.dirname(activeTextEditor.document.fileName) : vscode.workspace.rootPath
      filePath = await showInputBox({ value: suggestion, prompt: 'Where to put it' })
    }
    createComponent(name, filePath, stateful)
  }
  let disposable1 = vscCommands.registerCommand('extension.createReactClassComponent', async (ctx) => {
    executor(ctx, true)
  })
  let disposable2 = vscCommands.registerCommand('extension.createReactSFC', async (ctx) => {
    executor(ctx, false)
  })
  context.subscriptions.push(disposable1, disposable2)
}
exports.activate = activate

exports.deactivate = () => undefined

function createFile(dir) {
  return new Promise((resolve, reject) => {
    fs.open(dir, 'wx', (err, fd) => {
      if (err) {
        return reject('File allrady exists')
      }
      return resolve(fd)
    })
  })
}

function writeFile(file, data) {
  return new Promise((resolve, reject) => {
    fs.write(file, data, (err, fd) => {
      if (err) {
        return reject('File allrady exists')
      }
      return resolve(fd)
    })
  })
}

function ClassCompTemplate(name) {
  return `import React from 'react'
import './index.scss'

interface Props {

}

interface State {

}

export class ${name} extends React.Component<Props, State> {
  render() {
    return (
      <div className="${name.toLowerCase()}-wrapper">

      </div>
    )
  }
}

export default ${name}
`
}

function SFCTemplate(name) {
  return `import React from 'react'
import './index.scss'

interface Props {

}

export const ${name} = (props: Props) => {

  return (
    <div className="${name.toLowerCase()}-wrapper">

    </div>
  )
}

export default ${name}
`
}

function scssTemplate(name) {
  return `.${name.toLowerCase()}-wrapper{\n\n}\n`
}

async function createComponent(name, dir, isStateful) {
  try {
    const fileTsx = path.join(dir, name, 'index.tsx')
    const fileScss = path.join(dir, name, 'index.scss')

    mkDirByPathSync(path.join(dir, name))

    let tsxFile = await createFile(fileTsx)
    await writeFile(tsxFile, isStateful ? ClassCompTemplate(name) : SFCTemplate(name))
    fs.close(tsxFile, e => e && console.error(e))

    let cssFile = await createFile(fileScss)
    await writeFile(cssFile, scssTemplate(name))
    fs.close(cssFile, e => e && console.error(e))
  } catch (err) {
    console.error(err)
    vscode.window.showInformationMessage('Error: ' + err.message)
  }
}
