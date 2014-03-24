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
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>

#ifndef _TCPDEV_MAXCONN
#define _TCPDEV_MAXCONN 5
#endif
#ifndef _TCPDEV_BUFFERSIZE
#define _TCPDEV_BUFFERSIZE 1024
#endif

void sysError( char *message ) {
  perror(message);
  exit(1);
}

void userError( char *location, char *message ) {
  printf("[!] error in %s: %s\n", location, message);
  exit(1);
}

void usage( char *name ) {
  printf("usage: %s [port]\n", name);
  printf("  [port]     TCP port to bind server on\n");
  exit(1);
}

void handleTCPClient( int clientSocket ) {
  char buffer[_TCPDEV_BUFFERSIZE];

  ssize_t numBytesReceived = recv(clientSocket, buffer, _TCPDEV_BUFFERSIZE, 0);
  if (numBytesReceived < 0) sysError("recv()");

  while (numBytesReceived > 0) {
    ssize_t numBytesSent = send(clientSocket, buffer, numBytesReceived, 0);
    if (numBytesSent < 0) {
      sysError("send()");
    } else if (numBytesSent != numBytesReceived) {
      userError("send()", "unexpected number of bytes");
    }
    numBytesReceived = recv(clientSocket, buffer, _TCPDEV_BUFFERSIZE, 0);
    if (numBytesReceived < 0) sysError("recv()");
  }

  close(clientSocket);
}

int main( int argc, char **argv ) {
  typedef enum Boolean { false, true } Boolean;

  Boolean finished = false;
  char buffer[1024];
  in_port_t listenPort;
  int serverSock;
  static const char *version = "0.0.1";
  static const char *phase = "prealpha";
  struct sockaddr_in serverAddr;

  if (argc != 2) usage(argv[0]);
  listenPort = atoi(argv[1]);

  printf("tcpserver -- TCP-based protocol development harness (server) v%s-%s\n", version, phase);
  printf("Written by L0j1k@L0j1k.com -- Released under BSD3\n\n");

  if ((serverSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) < 0) error("socket()");
  memset(&serverAddr, 0, sizeof(serverAddr));
  serverAddr.sin_family = AF_INET;
  serverAddr.sin_addr.s_addr = htonl(INADDR_ANY);
  serverAddr.sin_port = htons(listenPort);

  if (bind(serverSock, (struct sockaddr *) &serverAddr, sizeof(serverAddr)) < 0) sysError("bind()");
  if (listen(serverSock, _TCPDEV_MAXCONN) < 0) sysError("listen()");

  while (!finished) {
    struct sockaddr_in clientAddr;
    socklen_t clientAddrLength = sizeof(clientAddr);
    int clientSock = accept(serverSock, (struct sockaddr *) &clientAddr, &clientAddrLength);
    if (clientSock < 0) sysError("accept()");

    char clientName[INET_ADDRSTRLEN];
    if (inet_ntop(AF_INET, &clientAddr.sin_addr.s_addr, clientName, sizeof(clientName)) != NULL) {
      printf("[+] inbound client: %s:%d\n", clientName, ntohs(clientAddr.sin_port));
    } else {
      printf("cannot get client address\n");
    }

    handleTCPClient(clientSock);
  }

  return 0;
}
