package com.vsnexa.v6;

public final class NexaSdkException extends RuntimeException {
  private final String code;
  private final String serverCode;
  private final Object details;

  public NexaSdkException(String code) { this(code, null, null); }
  public NexaSdkException(String code, Object details) { this(code, null, details); }
  public NexaSdkException(String code, String serverCode, Object details) {
    super(code);
    this.code = code;
    this.serverCode = serverCode;
    this.details = details;
  }
  public String code() { return code; }
  public String serverCode() { return serverCode; }
  public Object details() { return details; }
}
