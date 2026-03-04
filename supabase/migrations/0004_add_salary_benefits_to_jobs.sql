alter table jobs
add column if not exists salary_benefits text not null default '';

