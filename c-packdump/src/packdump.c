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
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>

void error( char *error ) {
  printf("error: %s\n", error);
  exit(1);
}

int main( int argc, char **argv ) {
  typedef enum Boolean { false, true } Boolean;

  static const char *version = "0.0.1";
  static const char *phase = "prealpha";

  int packetsock, listensock;
  Boolean finished = false;
  // @debug 1
  int rotations = 0;

  printf("packdump -- Packet dumper v%s-%s\n", version, phase);
  printf("Written by L0j1k@L0j1k.com -- Released under BSD3\n\n");

  if ((packetsock = socket(AF_PACKET, SOCK_RAW, htons(ETH_P_ALL))) < 0) error("socket() error");
  if ((listensock = listen(packetsock, 0)) < 0) error("listen() error");
  
  while (!finished) {
    // @debug begin
    printf(".");
    rotations++;
    if (rotations > 50) finished = true;
    // @debug end
  }
  // @debug 1
  printf("\n");
  
  return 0;
}
