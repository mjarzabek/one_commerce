module Orders
  # Licznik numerów zamówień konta w danym roku: 2026/000001, 2026/000002…
  class NumberSequence < ApplicationRecord
    def self.next_number(account, at: Time.current)
      year = at.year
      result = upsert(
        { account_id: account.id, year:, last_value: 1 },
        unique_by: %i[account_id year],
        on_duplicate: Arel.sql("last_value = #{quoted_table_name}.last_value + 1"),
        returning: :last_value,
        record_timestamps: false
      )
      format("%d/%06d", year, result.rows.first.first)
    end
  end
end
