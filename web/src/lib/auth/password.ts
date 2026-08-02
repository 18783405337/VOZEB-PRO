import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const HASH_ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const DUMMY_PASSWORD_HASH = `${HASH_ALGORITHM}$${ITERATIONS}$vozeb-pro-auth-dummy$bd3jzUHWM6ZtuhbdwvPKArj5YbI0kcc5Q3KjexiRKYw`;

export function hashPassword(password: string) {
    const salt = randomBytes(16).toString("base64url");
    const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
    return `${HASH_ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
    const [algorithm, iterationsRaw, salt, hash] = storedHash.split("$");
    if (algorithm !== HASH_ALGORITHM || !iterationsRaw || !salt || !hash) return false;
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations) || iterations < 1) return false;

    const expected = Buffer.from(hash, "base64url");
    const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyPasswordWithDummy(password: string, storedHash?: string) {
    const matched = verifyPassword(password, storedHash || DUMMY_PASSWORD_HASH);
    return Boolean(storedHash && matched);
}
