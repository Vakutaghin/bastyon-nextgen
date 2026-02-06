import * as CryptoJSModule from 'crypto-js';
const CryptoJS = CryptoJSModule.default || CryptoJSModule;
import { Buffer } from 'buffer';

function bufferToWordArray(buffer) {
    return CryptoJS.lib.WordArray.create(buffer);
}

function wordArrayToBuffer(wordArray) {
    return Buffer.from(wordArray.toString(CryptoJS.enc.Hex), 'hex');
}

export function sha256(buffer) {
    const wordArr = bufferToWordArray(buffer);
    const hash = CryptoJS.SHA256(wordArr);
    return wordArrayToBuffer(hash);
}

export function ripemd160(buffer) {
    const wordArr = bufferToWordArray(buffer);
    const hash = CryptoJS.RIPEMD160(wordArr);
    return wordArrayToBuffer(hash);
}

export function sha1(buffer) {
    const wordArr = bufferToWordArray(buffer);
    const hash = CryptoJS.SHA1(wordArr);
    return wordArrayToBuffer(hash);
}

export function hash160(buffer) {
    return ripemd160(sha256(buffer));
}

export function hash256(buffer) {
    return sha256(sha256(buffer));
}
