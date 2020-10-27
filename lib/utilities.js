//function to pick out charset from the given string of alphabets
function randomLowerAlpha(length) {
  return Array.apply(null, Array(length)).map(function() {
    return (function(charset){
      return charset.charAt(Math.floor(Math.random() * charset.length))
    }('abcdefghijklmnopqrstuvwxyz'));
  }).join('');
}

function randomRoom(...segments) {
  var pattern = [];
  for (length of segments) {
    pattern.push(randomLowerAlpha(length));
  }
  return pattern.join('-');
}

module.exports = { randomRoom };
