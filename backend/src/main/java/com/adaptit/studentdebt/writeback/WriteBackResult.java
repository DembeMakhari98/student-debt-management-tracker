package com.adaptit.studentdebt.writeback;

/** Outcome of one write-back attempt. {@code errorMessage} is null on success. */
public record WriteBackResult(boolean success, String errorMessage) {

    public static WriteBackResult ok() {
        return new WriteBackResult(true, null);
    }

    public static WriteBackResult failed(String errorMessage) {
        return new WriteBackResult(false, errorMessage);
    }
}
