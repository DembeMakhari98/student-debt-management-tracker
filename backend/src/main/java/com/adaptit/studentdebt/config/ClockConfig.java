package com.adaptit.studentdebt.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/** A single injectable {@link Clock}, so time-dependent logic (e.g. retention purging) is testable. */
@Configuration
public class ClockConfig {

    /**
     * Pinned to the institution's timezone rather than the host JVM's default — a POPIA retention
     * boundary (issue #20) must land on the same calendar day regardless of which environment the
     * scheduled job happens to run in.
     */
    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of("Africa/Johannesburg"));
    }
}
