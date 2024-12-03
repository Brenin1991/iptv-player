import pyshark
import socket

# Função para obter o IP local da máquina
def get_local_ip():
    # O socket aqui tenta se conectar a um servidor externo para descobrir o IP local
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        s.connect(('10.254.254.254', 1))  # Tentando se conectar com um IP qualquer
        ip = s.getsockname()[0]  # Retorna o IP local
    except Exception:
        ip = '127.0.0.1'  # Caso falhe, retorna o localhost
    finally:
        s.close()
    return ip

def capture_traffic():
    local_ip = get_local_ip()  # Obtém o IP local

    print(f"Capturando tráfego... Seu IP local é {local_ip}")
    
    capture = pyshark.LiveCapture(interface='Wifi', display_filter='ip')

    # Captura pacotes de forma contínua
    for packet in capture.sniff_continuously():
        if 'IP' in packet:
            try:
                # Verificar se o IP do pacote é o mesmo do IP local (ignorar)
                if packet.ip.src == local_ip or packet.ip.dst == local_ip:
                    continue  # Ignora pacotes com o IP local

                # Exibe informações básicas sobre os pacotes IP
                print(f"[+] Pacote IP detectado:")
                print(f"    Source IP: {packet.ip.src}")
                print(f"    Destination IP: {packet.ip.dst}")
                print(f"    Protocol: {packet.transport_layer}")  # Exibe o tipo de protocolo (TCP, UDP, etc.)

                # Se o pacote for HTTP, também exibe as informações HTTP
                if 'HTTP' in packet:
                    print(f"    HTTP Host: {packet.http.host}")
                    print(f"    HTTP User-Agent: {packet.http.user_agent}")

            except AttributeError:
                pass  # Ignora pacotes que não possuem os atributos esperados

if __name__ == "__main__":
    capture_traffic()
