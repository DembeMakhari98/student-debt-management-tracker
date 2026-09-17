package com.adaptit.studentdebt;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class StudentDebtTrackerApplication {

	public static void main(String[] args) {
		SpringApplication.run(StudentDebtTrackerApplication.class, args);
	}

}
