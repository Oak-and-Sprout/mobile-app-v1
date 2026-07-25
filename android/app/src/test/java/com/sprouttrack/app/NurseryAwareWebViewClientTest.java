package com.sprouttrack.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Host-JVM unit test for the path matcher. It's a plain string function
 * (no android.net.Uri) specifically so it can run here without Robolectric
 * or an instrumented device/emulator.
 */
public class NurseryAwareWebViewClientTest {

    @Test
    public void matchesNurseryModeRoute() {
        assertTrue(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/my-family/nursery-mode"));
    }

    @Test
    public void matchesWithTrailingSlash() {
        assertTrue(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/my-family/nursery-mode/"));
    }

    @Test
    public void matchesWithQueryString() {
        assertTrue(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/my-family/nursery-mode?tab=log"));
    }

    @Test
    public void matchesWithFragment() {
        assertTrue(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/my-family/nursery-mode#section"));
    }

    @Test
    public void matchesBarePathWithoutSchemeOrHost() {
        assertTrue(NurseryAwareWebViewClient.isNurseryPath("/my-family/nursery-mode"));
    }

    @Test
    public void rejectsPrefixMatchInsteadOfExactSegment() {
        assertFalse(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/my-family/nursery-mode-settings"));
    }

    @Test
    public void rejectsOtherRoutes() {
        assertFalse(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/my-family/log-entry"));
    }

    @Test
    public void rejectsTooFewSegments() {
        assertFalse(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/nursery-mode"));
        assertFalse(NurseryAwareWebViewClient.isNurseryPath("https://families.example.com/"));
    }

    @Test
    public void rejectsNullOrEmpty() {
        assertFalse(NurseryAwareWebViewClient.isNurseryPath(null));
        assertFalse(NurseryAwareWebViewClient.isNurseryPath(""));
    }
}
