/**
 * StudentInfo Component
 *
 * Displays student name, email, and phone number.
 * Used in list rows to show student contact information.
 */

import React from 'react';
import { StudentInfoProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Student Info Component
 *
 * @example
 * <StudentInfo
 *   studentName="John Doe"
n *   studentEmail="john@example.com"
 *   studentPhone="0123456789"
 * />
 */
const StudentInfo: React.FC<StudentInfoProps> = ({
  studentName,
  studentEmail,
  studentPhone,
}) => {
  return (
    <div className={styles.studentInfo}>
      <div className={styles.studentName}>{studentName}</div>
      <div className={styles.studentEmail}>{studentEmail}</div>
      <div className={styles.studentPhone}>{studentPhone}</div>
    </div>
  );
};

export default StudentInfo;
