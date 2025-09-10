import validator from "validator";

function isUserNameMobileNo(value: string): boolean {
  return /^\d+$/.test(value) && !value.includes("@");
}

const isValidEmail = (email: string): boolean => {
  return validator.isEmail(email);
};

function isValidMobile(username: string): boolean {
  return /^[6-9]\d{9}$/.test(username); // Matches Indian mobile numbers starting 6-9
}

export { isUserNameMobileNo, isValidEmail, isValidMobile };
