# Lokalne CI: `bin/ci`

CI.run do
  step "Setup", "bin/setup --skip-server"

  step "Style: Ruby", "bin/rubocop"
  step "Boundaries: Packwerk validate", "bin/packwerk validate"
  step "Boundaries: Packwerk check", "bin/packwerk check"
  step "Frontend: TypeScript", "npm run check"

  step "Tests: RSpec", "bundle exec rspec"

  step "Security: Gem audit", "bin/bundler-audit"
  step "Security: Brakeman code analysis", "bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error"
end
