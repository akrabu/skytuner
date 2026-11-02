#include <stdio.h>
#include <stdlib.h>
#include "swephexp.h"
int main(int argc,char **argv) {
  if(argc!=12)return 2;
  swe_set_ephe_path(argv[1]);
  double jd[2],xx[6],cusps[13],angles[10];char error[256];
  int status=swe_utc_to_jd(atoi(argv[2]),atoi(argv[3]),atoi(argv[4]),atoi(argv[5]),atoi(argv[6]),atof(argv[7]),SE_GREG_CAL,jd,error);
  if(status<0){fprintf(stderr,"%s",error);return 3;}
  int bodies[]={0,1,2,3,4,5,6,7,8,9,15,11};
  printf("{\"positions\":[");
  for(int i=0;i<12;i++) {
    int flags=swe_calc_ut(jd[1],bodies[i],SEFLG_SWIEPH|SEFLG_SPEED,xx,error);
    if(flags<0){fprintf(stderr,"%s",error);return 4;}
    printf("%s[%.12f,%.12f]",i?",":"",xx[0],xx[3]);
  }
  status=swe_houses_ex(jd[1],0,atof(argv[8]),atof(argv[9]),argv[10][0],cusps,angles);
  printf("],\"houseStatus\":%d,\"cusps\":[",status);
  for(int i=1;i<=12;i++)printf("%s%.12f",i>1?",":"",cusps[i]);
  printf("],\"ascendant\":%.12f,\"mc\":%.12f}",angles[0],angles[1]);
  swe_close();return 0;
}
