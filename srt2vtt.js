const fs = require('fs');

exports.convert = (file) => {
  if(!file) return 'WEBVTT \n';

  const data =  fs.readFileSync(file, 'utf8');
  const lines = data.split('\n')
  const convertedLines = lines.map(line => {
    if(line.includes('-->')) {
      return line.replace(/\,/g, '.');
    }
    return line;
  });
  const output = ['WEBVTT \n', ...convertedLines].join('\n');
  return output;
}
