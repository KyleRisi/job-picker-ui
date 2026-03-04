update jobs
set description = trim(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(description, '�', ''''),
              'â€™',
              ''''
            ),
            'â€˜',
            ''''
          ),
          'â€œ',
          '"'
        ),
        'â€',
        '"'
      ),
      'â€“',
      '-'
    ),
    'â€”',
    '-'
  )
)
where description like '%�%'
   or description like '%â€™%'
   or description like '%â€˜%'
   or description like '%â€œ%'
   or description like '%â€%'
   or description like '%â€“%'
   or description like '%â€”%';
