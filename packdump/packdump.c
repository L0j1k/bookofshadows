/**
 * @project Packet Dump
 * Dump packets to a file from a listening interface. Requires root to run.
 * @file packdump.c
 * Primary application driver.
 * @author L0j1k
 * @contact L0j1k@L0j1k.com
 * @license BSD3
 * @version 0.0.1-prealpha
 */

#include <net/ethernet.h>
#include <netpacket/packet.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>

int main( int argc, char **argv ) {
  static const char *version = "0.0.1";
  static const char *phase = "prealpha";

  typedef enum Boolean { false, true } Boolean;

  printf("packdump -- Packet dumper v%s-%s\n", version, phase);
  printf("Written by L0j1k@L0j1k.com -- Released under BSD3\n\n");

  int packet_socket = socket(AF_PACKET, SOCK_RAW, htons(ETH_P_ALL));
  Boolean finished = false;
  int rotations = 0;
  
  while (!finished) {
    printf(".");
    rotations++;
    if (rotations > 50) finished = true;
  }
  printf("\n");
  
  return 0;
}
