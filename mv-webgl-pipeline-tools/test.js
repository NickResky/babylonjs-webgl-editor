require('@babel/register')({
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          esmodules: true,
        },
      },
    ],
  ]
});

var appendSlash = function(path) {
  if (!path.endsWith('/')) {
      path += '/';
  }
  return path;
}

var fs = require('fs');
var rimraf = require("rimraf");

fs.readFile('C:/Users/nreschke/Downloads/Ferrari_Materials.txt', 'utf8', function(err, data) {
  const names = data.split(/\r?\n/);
  names.forEach(name => {
    const json = {}
    const path = 'C:/Users/nreschke/Downloads/test/' + name + '.json'
    fs.writeFileSync(path, JSON.stringify(json));  
  })
});
