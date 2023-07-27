## Parser

1) `parser.py` – python script to parse the from https://ethleaderboard.xyz to get pairs of address and twitter name.
2) `utils.py` – python script with helper functions.

### Remarks
About broken lines. Some editors stumbles where there are double quotes inside the string. Attached are three tables.

- parsed_all_data_raw.csv - no change. Not all editors read, python picks up.
- parsed_all_data_cleaned.csv - double quotes removed everywhere. The data has been changed, but the office now opens without errors.
- parsed_all_data_quoted.csv - each cell is escaped with | character. Should work everywhere, but the file is overloaded.
- parsed_all_data.json - collected data to make it easier to work with.

