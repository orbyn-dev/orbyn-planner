import { SignInUnavailable } from "../../core/account/authCrypto";
import { ApiFailure } from "../../core/account/errors";
import { cryptoLoad } from "../../state/crypto";
import { MODULE_LOAD_FAILED } from "./CryptoProblem";

/** A readable line for whatever went wrong. */
export function describeError(error: unknown): string {
  if (error instanceof SignInUnavailable) return cryptoLoad.get() === "failed" ? `${MODULE_LOAD_FAILED}.` : error.message + ".";
  if (error instanceof ApiFailure) return error.message;
  return "Something went wrong. Try again.";
}
