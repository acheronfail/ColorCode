const cp = require('child_process');
const fse = require('fs-extra');
const path = require('path');
const which = require('which');
const FileHound = require('filehound');

// Adds unix-like `pushdir` and `popdir` to the process object.
require('dirutils');

// Pass 'update' to this script to update CodeMirror submodule to latest.
const update = process.argv[2] == 'update';
console.log(`${update ? 'Updating' : 'Building'} CodeMirror...`);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR   = path.join(PROJECT_ROOT, 'src');

// Files we extract from CodeMirror.
const CM_SUBMODULE   = path.join(PROJECT_ROOT, 'CodeMirror');
const CM_ADDONS = [
  path.join(CM_SUBMODULE, 'addon', 'mode', 'simple.js'),
  path.join(CM_SUBMODULE, 'addon', 'dialog', 'dialog.js'),
  path.join(CM_SUBMODULE, 'addon', 'dialog', 'dialog.css'),
  path.join(CM_SUBMODULE, 'addon', 'search', 'searchcursor.js'),
  path.join(CM_SUBMODULE, 'addon', 'search', 'search.js'),
];
const CM_THEMES      = path.join(CM_SUBMODULE, 'theme');
const CM_MODES       = path.join(CM_SUBMODULE, 'mode');
const CM_LIBS        = path.join(CM_SUBMODULE, 'lib');

// Destinations for the files we extract.
const CM_DEST             = path.join(SOURCE_DIR, 'codemirror');
const CM_DEST_SIMPLE_MODE = path.join(CM_DEST, 'addon', 'mode', 'simple.js');
const CM_DEST_ADDONS = [
  path.join(CM_DEST, 'addon', 'mode', 'simple.js'),
  path.join(CM_DEST, 'addon', 'dialog', 'dialog.js'),
  path.join(CM_DEST, 'addon', 'dialog', 'dialog.css'),
  path.join(CM_DEST, 'addon', 'search', 'searchcursor.js'),
  path.join(CM_DEST, 'addon', 'search', 'search.js'),
];
const CM_DEST_THEMES      = path.join(CM_DEST, 'theme');
const CM_DEST_MODES       = path.join(CM_DEST, 'mode');
const CM_DEST_LIBS        = path.join(CM_DEST, 'lib');

// Do we have git? (this will throw if not).
which.sync('git');

// Update CodeMirror submodule to latest and rebuild its libs.
run('git', ['submodule', 'update', '--init']);
process.pushdir(CM_SUBMODULE);
if (update) {
  console.log('Updating CodeMirror to latest commit...');
  run('git', ['checkout', 'master']);
  run('git', ['pull', 'origin', 'master']);
}
console.log('Installing dependencies for CodeMirror...');
run('npm', ['install']);
run('npm', ['run', 'build']);
console.log('Done installing CodeMirror');
process.popdir();

// Copy over the files we use from CodeMirror.
console.log('Copying necessary files...');
fse.removeSync(CM_DEST);
fse.ensureDirSync(CM_DEST);
for (let i = 0; i < CM_ADDONS.length; ++i) {
  fse.ensureDirSync(path.dirname(CM_DEST_ADDONS[i]));
  fse.copySync(CM_ADDONS[i], CM_DEST_ADDONS[i]);
}
fse.copySync(CM_THEMES, CM_DEST_THEMES);
fse.copySync(CM_MODES, CM_DEST_MODES);
fse.copySync(CM_LIBS, CM_DEST_LIBS);

// Strip copied directories of unnecessary files.
FileHound.create()
  .paths(CM_DEST_MODES)
  .find((err, files) => {
    if (err) throw err;
    files.map((filepath) => {
      // Only keep '.js' files in these directories.
      if (path.extname(filepath) != '.js') {
        fse.removeSync(filepath);
      }
    });

    console.log('Complete!');
    process.exit();
  });

// Helpers ---------------------------------------------------------------------

// Run a command synchronously.
function run(cmd, args) {
  const res = cp.spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.status != 0) {
    throw res.error || new Error(`Command failed! ${cmd} ${args.join(' ')}`);
  }
}
