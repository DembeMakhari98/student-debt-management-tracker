package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.Debtor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtorRepository extends JpaRepository<Debtor, String> {

    List<Debtor> findAllByFinancialYear(Integer financialYear);

    List<Debtor> findAllByOrderByFinancialYearAsc();
}
