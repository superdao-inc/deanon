import datetime
import json
import requests
import logging

from utils import save_json, standard_setting_for_logging, try_again, load_json, save_csv

logger = logging.getLogger(__name__)
standard_setting_for_logging(logger)


def request_ethleaderboard_data(save_to_fn: str) -> None:
    headers = {
        'Content-Type': 'application/json',
    }

    count = 500
    init_skip = 0
    res = []

    skip = init_skip
    try:
        step_time = datetime.datetime.now()
        while True:
            _url = f"https://ethleaderboard.xyz/api/frens?count={count}&skip={skip}"
            response = requests.get(_url, headers=headers)
            if response is None:
                logger.error(f"Error get count {count}, skip {skip}")
            items = response.json()["frens"]
            if not len(items):
                break

            res.extend(items)
            skip += count
            if skip % 10000 == 0:
                logger.debug(f"Skip {skip} complete. {datetime.datetime.now() - step_time} sec")
                step_time = datetime.datetime.now()
    except:
        logger.exception(f"Error in count {count}, skip {skip}")
    finally:
        logger.info(f"Complete parsing. Items {len(res)}. Init skip {init_skip}, skip {skip}, count {count}")
        save_json(save_to_fn, res)


@try_again
def request_thegraph_data(ens_list: list) -> list:
    api_url = "https://api.thegraph.com/subgraphs/name/ensdomains/ens"
    headers = {
        'Content-Type': 'application/json',
    }

    query_str = """query Q($ens_list: [String!]){
        domains(where: {name_in: $ens_list}) {
            name
            owner {
              id
            }
          }
        }"""

    data = {
        "query": query_str,
        "variables": {
            "ens_list": ens_list
        }
    }

    data = json.dumps(data)
    response = requests.post(api_url, headers=headers, data=data)
    try:
        ens_data = response.json()["data"]["domains"]
    except:
        logger.error(f"Error request batch start {ens_list[0]}\n {response.text}")
        ens_data = []

    return ens_data


def request_addresses_by_ens(ens_data_filename: str, result_data_filename: str) -> None:
    def chunk_list(datas, chunk_size):
        for j in range(0, len(datas), chunk_size):
            yield datas[j:j + chunk_size]

    in_data = load_json(ens_data_filename)
    out_data = []

    ens_batch_count = 100
    last_iter = 0
    try:
        for i, acc_datas in enumerate(chunk_list(in_data, ens_batch_count)):
            ens_batch_list = [acc["ens"] for acc in acc_datas]
            ens_address_data = request_thegraph_data(ens_batch_list)
            ens_address_data = {dt["name"]: dt["owner"]["id"] for dt in ens_address_data}
            for ens_twitter_data in acc_datas:
                ens = ens_twitter_data["ens"]
                try:
                    address = ens_address_data[ens]
                except KeyError:
                    address = ""
                    logger.warning(f"Not found address by ens {ens}")

                out_data.append({
                    **ens_twitter_data,
                    "address": address
                })
            last_iter = i
            if i % 100 == 0:
                logger.info(f"Batch {ens_batch_count * i} complete")
    except:
        logger.exception(f"Error parse in count {last_iter}")
    finally:
        save_json(result_data_filename, out_data)


def main():
    ethleaderboard_data_filename = "ethleaderboard_data.json"
    result_data_filename = "parsed_all_data.json"
    result_table_filename = "parsed_all_data.csv"

    import csv
    # request twitters data
    request_ethleaderboard_data(ethleaderboard_data_filename)
    # request ens data
    request_addresses_by_ens(ethleaderboard_data_filename, result_data_filename)
    # convert json data to csv
    save_csv(result_table_filename, load_json(result_data_filename))


if __name__ == '__main__':
    main()
