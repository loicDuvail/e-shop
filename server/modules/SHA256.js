let SHA256InfoDisplay = false;

/////////useful functions/////////////////
function ROTR(binary, degree) {
    if (typeof binary != "string")
        return console.log("wrong input type in ROTR"), console.log(binary);
    for (let i = 0; i < degree; i++) {
        binary = binary[binary.length - 1] + binary;
        binary = binary.slice(0, -1);
    }
    return binary;
}
function SHR(binary, degree) {
    for (let i = 0; i < degree; i++) {
        binary = "0" + binary;
        binary = binary.slice(0, -1);
    }
    return binary;
}
let bin2Dec = (bin) => parseInt(bin, 2);

function dec2Bin(dec) {
    let bin = (dec >>> 0).toString(2);
    let desiredBinLen = 32;
    while (bin.length < desiredBinLen) bin = "0" + bin;
    while (bin.length > desiredBinLen) bin = bin.slice(1);
    return bin;
}
let bin2Hex = (bin) => {
    let hex = parseInt(bin, 2).toString(16);
    while (hex.length < 8) hex = "0" + hex;
    while (hex.length > 8) hex = hex.slice(1);
    return hex;
};
function hex2Bin(hex) {
    let bin = parseInt(hex, 16).toString(2);
    let desiredBinLen = 32;
    while (bin.length < desiredBinLen) bin = "0" + bin;
    while (bin.length > desiredBinLen) bin = bin.slice(1);
    return bin;
}
function hexArray2Bin(hexArray) {
    let binArray = [];
    for (let i = 0; i < hexArray.length; i++) {
        binArray[i] = hex2Bin(hexArray[i]);
    }
    return binArray;
}
function binArray2Hex(binArray) {
    let hexArray = [];
    for (let i = 0; i < binArray.length; i++) {
        hexArray[i] = bin2Hex(binArray[i]);
    }
    return hexArray;
}
//logic operators
function XOR(bin1, bin2) {
    let dec1 = bin2Dec(bin1);
    let dec2 = bin2Dec(bin2);
    let decOut = dec1 ^ dec2;
    return dec2Bin(decOut);
}
function NOT(bin) {
    let dec = bin2Dec(bin);
    dec = ~dec;
    return dec2Bin(dec);
}
function PLUS(bin1, bin2) {
    let dec1 = bin2Dec(bin1);
    let dec2 = bin2Dec(bin2);
    let decOut = dec1 + dec2;
    return dec2Bin(decOut);
}
function AND(bin1, bin2) {
    let dec1 = bin2Dec(bin1);
    let dec2 = bin2Dec(bin2);
    let decOut = dec1 & dec2;
    return dec2Bin(decOut);
}
//////////////

function text2Bin(text) {
    let bin = "";
    let textLen = text.length;
    for (let i = 0; i < textLen; i++) {
        let binLetter = text.charCodeAt(i).toString(2);
        while (binLetter.length < 8) binLetter = "0" + binLetter;
        bin += binLetter;
    }
    return bin;
}

let getLenInBin = (input) => (input.length * 8).toString(2);

function getBlockNb(input) {
    let blockNb = Math.floor(input.length / 512) + 1;
    if (input.length - (blockNb - 1) * 512 > 448) blockNb += 1;
    return blockNb;
}

function createBlocks(input) {
    let blockArray = [];
    let binInput = text2Bin(input) + "1";
    if (SHA256InfoDisplay) console.log("bin input: " + binInput); //NN
    let blockNb = getBlockNb(binInput);
    if (SHA256InfoDisplay) console.log(blockNb + " block"); //NN
    let binLen = getLenInBin(input);
    while (binLen.length < 64) binLen = "0" + binLen;

    for (let i = 0; i < blockNb; i++) {
        blockArray[i] = binInput.slice(i * 512, (i + 1) * 512);
        while (blockArray[i].length < 512) blockArray[i] += "0";
        if (i == blockNb - 1) {
            blockArray[i] = binInput.slice(i * 512, i * 512 + 448);
            while (blockArray[i].length < 448) blockArray[i] += "0";
            blockArray[i] += binLen;
        }
    }
    return blockArray;
}

function divideIntoWords(block) {
    let words = [];
    let wordLen = 32;
    for (let i = 0; i < 16; i++) {
        words.push(block.slice(i * wordLen, (i + 1) * wordLen));
    }
    return words;
}
///// SHA256 functions //////////////

let sigma0 = (x) => XOR(XOR(ROTR(x, 7), ROTR(x, 18)), SHR(x, 3));

let sigma1 = (x) => XOR(XOR(ROTR(x, 17), ROTR(x, 19)), SHR(x, 10));

let sigmaMaj0 = (x) => XOR(XOR(ROTR(x, 2), ROTR(x, 13)), ROTR(x, 22));

let sigmaMaj1 = (x) => XOR(XOR(ROTR(x, 6), ROTR(x, 11)), ROTR(x, 25));

let Ch = (x, y, z) => XOR(AND(x, y), AND(NOT(x), z));

let Maj = (x, y, z) => XOR(XOR(AND(x, y), AND(x, z)), AND(y, z));

///// word gen//////

function wordGen(W) {
    for (let t = 16; t < 64; t++) {
        W[t] = PLUS(
            PLUS(PLUS(sigma1(W[t - 2]), W[t - 7]), sigma0(W[t - 15])),
            W[t - 16]
        );
    }
    let wordArray64 = W;
    return wordArray64;
}
//// SHA256 constants////

const K = [
    "428a2f98",
    "71374491",
    "b5c0fbcf",
    "e9b5dba5",
    "3956c25b",
    "59f111f1",
    "923f82a4",
    "ab1c5ed5",
    "d807aa98",
    "12835b01",
    "243185be",
    "550c7dc3",
    "72be5d74",
    "80deb1fe",
    "9bdc06a7",
    "c19bf174",
    "e49b69c1",
    "efbe4786",
    "0fc19dc6",
    "240ca1cc",
    "2de92c6f",
    "4a7484aa",
    "5cb0a9dc",
    "76f988da",
    "983e5152",
    "a831c66d",
    "b00327c8",
    "bf597fc7",
    "c6e00bf3",
    "d5a79147",
    "06ca6351",
    "14292967",
    "27b70a85",
    "2e1b2138",
    "4d2c6dfc",
    "53380d13",
    "650a7354",
    "766a0abb",
    "81c2c92e",
    "92722c85",
    "a2bfe8a1",
    "a81a664b",
    "c24b8b70",
    "c76c51a3",
    "d192e819",
    "d6990624",
    "f40e3585",
    "106aa070",
    "19a4c116",
    "1e376c08",
    "2748774c",
    "34b0bcb5",
    "391c0cb3",
    "4ed8aa4a",
    "5b9cca4f",
    "682e6ff3",
    "748f82ee",
    "78a5636f",
    "84c87814",
    "8cc70208",
    "90befffa",
    "a4506ceb",
    "bef9a3f7",
    "c67178f2",
];
const H = [
    "6a09e667",
    "bb67ae85",
    "3c6ef372",
    "a54ff53a",
    "510e527f",
    "9b05688c",
    "1f83d9ab",
    "5be0cd19",
];
//// intermediate hash ////

function intermediateHasher(wordArray64, previousHash) {
    let W = wordArray64;
    let a = previousHash[0];
    let b = previousHash[1];
    let c = previousHash[2];
    let d = previousHash[3];
    let e = previousHash[4];
    let f = previousHash[5];
    let g = previousHash[6];
    let h = previousHash[7];

    for (let t = 0; t < 64; t++) {
        let T1 = PLUS(
            PLUS(PLUS(PLUS(h, sigmaMaj1(e)), Ch(e, f, g)), hex2Bin(K[t])),
            W[t]
        );
        let T2 = PLUS(sigmaMaj0(a), Maj(a, b, c));
        h = g;
        g = f;
        f = e;
        e = PLUS(d, T1);
        d = c;
        c = b;
        b = a;
        a = PLUS(T1, T2);
        let valueDisplay = [a, b, c, d, e, f, g, h, T1, T2];
    }
    let hash = [a, b, c, d, e, f, g, h];
    return hash;
}
//////////final function//////////////

function SHA256(input) {
    let blockArray = createBlocks(input);
    let binInput = text2Bin(input) + 1;
    let blockNb = getBlockNb(binInput);
    //starts with the initial hash values "H"
    let previousHash = hexArray2Bin(H);
    for (let i = 0; i < blockNb; i++) {
        if (SHA256InfoDisplay) console.log("itteration n°" + parseInt(i + 1)); //NN
        let wordArray16 = divideIntoWords(blockArray[i]);
        if (SHA256InfoDisplay) console.log(binArray2Hex(wordArray16)); //NN
        let wordArray64 = wordGen(wordArray16);
        if (SHA256InfoDisplay) console.log(binArray2Hex(wordArray64)); //NN
        let intermediateHash = intermediateHasher(wordArray64, previousHash);
        for (let i = 0; i < intermediateHash.length; i++) {
            intermediateHash[i] = PLUS(intermediateHash[i], previousHash[i]);
        }
        previousHash = intermediateHash;
        if (SHA256InfoDisplay)
            console.log("previous hash", binArray2Hex(previousHash)); //NN
    }
    let binDigest = previousHash;
    let hexDigest = binArray2Hex(binDigest);
    let digest = "";
    for (let i = 0; i < 8; i++) {
        digest += hexDigest[i];
    }
    return digest;
}
try {
    module.exports = SHA256;
} catch (e) {
    console.log(e);
}
