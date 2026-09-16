import { redactForTest } from "./error.middleware.js";

/**
 * Proves the development-only error message cannot carry a filesystem path.
 *
 * This exists because a real one reached a real screen: the sign-in page
 * rendered a Prisma failure verbatim, including
 * `D:\Harsh\The-Promise-Jewels mode 10\server\src\modules\auth\…` and the
 * database hostname, to anybody who could load it.
 *
 * The first fix did not work, and the reason is worth keeping: the pattern
 * used `[^\s"']*`, which stops at the first space — and this project's own
 * path has spaces in it ("The-Promise-Jewels mode 10"). It matched nothing and
 * looked fine. Hence a test with the actual string in it.
 *
 * Run with `npm run error:check`.
 */

let failures = 0;

function check(what: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${what}${detail ? `   ${detail}` : ""}`);
  if (!passed) failures += 1;
}

// Built from a character code so no editor, shell or copy-paste can quietly
// turn the backslashes into something else — which is how the first attempt
// at this test fooled itself into passing.
const B = String.fromCharCode(92);

const WINDOWS_PATH =
  `D:${B}Harsh${B}The-Promise-Jewels mode 10${B}server${B}src${B}modules${B}auth${B}auth.repository.ts`;

const REAL_MESSAGE = [
  "Invalid `prisma.user.findUnique()` invocation in",
  `${WINDOWS_PATH}:5:24`,
  "",
  "Can't reach database server at `aws-1-ap-south-1.pooler.supabase.com:6543`",
].join("\n");

console.log("\n1. The message that actually leaked");
const cleaned = redactForTest(REAL_MESSAGE) ?? "";
check("the project directory is gone", !cleaned.includes("The-Promise-Jewels mode"));
check("the user's name is gone", !cleaned.includes("Harsh"));
check("the drive letter is gone", !/[A-Za-z]:\\/.test(cleaned));
check("the file name survives", cleaned.includes("auth.repository.ts"), "(still diagnosable)");
check(
  "the reason survives",
  cleaned.includes("Can't reach database server"),
  "(still the point of the message)",
);

console.log("\n2. POSIX paths");
const posix = redactForTest("failed at /home/harsh/app/server/src/db.ts line 3") ?? "";
check("the directories are gone", !posix.includes("/home/harsh"));
check("the file name survives", posix.includes("db.ts"), `(${posix})`);

console.log("\n3. Messages with no path in them are left alone");
const plain = "Unique constraint failed on the fields: (`email`)";
check("unchanged", redactForTest(plain) === plain);
check("undefined stays undefined", redactForTest(undefined) === undefined);
check("empty stays empty", redactForTest("") === "");

console.log(failures === 0 ? "\nALL PASSED\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
