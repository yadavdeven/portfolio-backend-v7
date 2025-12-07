const textConstants = {
  SOMETHING_WENT_WRONG: "Something went wrong",
  AUTHENTICATION_FAILED: "Authentication failed",
};

export type TextConstants = keyof typeof textConstants;
export default textConstants;
