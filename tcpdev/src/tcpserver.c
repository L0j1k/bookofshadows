/**
 * @project TCP-based Protocol Development Harness
 * Harness for TCP-based protocol development.
 * @file tcpserver.c
 * Simple TCP server.
 * @author L0j1k
 * @contact L0j1k@L0j1k.com
 * @license BSD3
 * @version 0.0.1-prealpha
 */

#include <arpa/inet.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>

#ifndef _TCPDEV_MAXCONN
#define _TCPDEV_MAXCONN 5
#endif

void error( char *message ) {
  perror(message);
  exit(1);
}

void usage( char *name ) {
  printf("usage: %s [port]\n", name);
  printf("  [port]     TCP port to bind server on\n");
  exit(1);
}

int main( int argc, char **argv ) {
  typedef enum Boolean { false, true } Boolean;

  Boolean finished = false;
  char buffer[1024];
  int bindSock, listenSock, serverSock;
  static const char *version = "0.0.1";
  static const char *phase = "prealpha";
  struct sockaddr_in clientAddr;
  struct sockaddr_in serverAddr;
  unsigned short listenport;

  if (argc != 2) usage(argv[0]);
  listenport = *argv[1];

  printf("tcpserver -- TCP-based protocol development harness (server) v%s-%s\n", version, phase);
  printf("Written by L0j1k@L0j1k.com -- Released under BSD3\n\n");

  if ((serverSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) < 0) error("socket()");
  memset(&serverAddr, 0, sizeof(serverAddr));
  serverAddr.sin_family = AF_INET;
  serverAddr.sin_addr.s_addr = htonl(INADDR_ANY);
  serverAddr.sin_port = htons(listenport);

  if ((bindSock = bind(serverSock, (struct sockaddr *) &serverAddr, sizeof(serverAddr))) < 0) error("bind()");

  if ((listenSock = listen(serverSock, _TCPDEV_MAXCONN)) < 0) error("listen()");

  while (!finished) {
    // @debug begin
    
    // @debug end
  }

  return 0;
}
