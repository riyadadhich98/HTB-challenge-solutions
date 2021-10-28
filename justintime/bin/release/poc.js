function opt_me() {
  let x = Math.random();
  let y = x + 2;
  return y + 3;
}

%OptimizeFunctionOnNextCall(opt_me);
