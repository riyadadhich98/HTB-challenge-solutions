function f(x)
{
	const arr = new Array(1.1, 2.2, 3.3, 4.4, 5.5, 6.6);
	let t = (x == 1 ? 9007199254740992 : 9007199254740989) + 1 + 1;
	t -= 9007199254740989; // t can be 5, but expect <= 3
	return arr[t];
}

console.log(f(1));
%OptimizeFunctionOnNextCall(f);
console.log(f(1));
