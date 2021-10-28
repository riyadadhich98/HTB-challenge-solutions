function opt_me() {
  let x = Math.random();
  let y = x + 2;
  return y + 3;
}

for (var i = 0; i < 0x10000; ++i) {
  opt_me();
}
