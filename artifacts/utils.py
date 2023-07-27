import os
import json
import csv
import time
from functools import wraps
import logging


logger = logging.getLogger(__name__)


def standard_setting_for_logging(_logger):
    date_format = "%Y-%m-%d %H:%M:%S"
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    c_handler = logging.StreamHandler()
    c_format = logging.Formatter(fmt=log_format, datefmt=date_format)
    c_handler.setFormatter(c_format)
    _logger.addHandler(c_handler)
    _logger.setLevel(logging.DEBUG)


def try_again(func):
    max_iter_attempts = 5

    @wraps(func)
    def decorator(self, *args, **kwargs):
        current_iter_attempts = 0
        while True:
            current_iter_attempts += 1
            try:
                res = func(self, *args, **kwargs)
                break
            except Exception as e:
                if current_iter_attempts >= max_iter_attempts:
                    raise e
                time.sleep(5)

            fn_name = func.__name__
            logger.debug(f"attempt {current_iter_attempts} {fn_name}")
        return res
    return decorator


def load_json(filename):
    with open(filename, 'r') as fp:
        json_data = json.load(fp)
        logger.debug(f"Load file: {filename}")
    return json_data


def save_json(filename, out_dict):
    with open(filename, 'w') as fp:
        json.dump(out_dict, fp, indent=2)
        logger.debug(f"Save to: {filename}")
    return out_dict


def save_csv(filename, data: list, delimiter=';'):
    if not len(data):
        raise ValueError('No values in csv data!')

    if isinstance(data[0], dict):
        headers = data[0].keys()
        rows = [headers]
        for row_dict in data:
            row = []
            for header in headers:
                row.append(row_dict[header])
            rows.append(row)
    else:
        rows = data

    with open(filename, "w") as f:
        writer = csv.writer(f, delimiter=delimiter, quotechar='|',  lineterminator=os.linesep)#, quoting=csv.QUOTE_ALL)
        writer.writerows(rows)
        logger.debug(f"save to: {filename}")
    return
