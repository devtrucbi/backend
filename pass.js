const bcrypt = require('bcryptjs');
const password = 'admin123';
bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log(hash);
});