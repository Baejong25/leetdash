import java.util.*;

class Solution {
    public int solution(int n, int[] stations, int w) {

        int count = 0;
        int idx = 0;
        int range = (2 * w + 1);

        for(int i = 0; i < stations.length; i++){
            int a = stations[i]-1;

            int start = 0;
            int end = 0;

            if(a-w >= 0){
                start = a-w;
            }else{
                start = 0;
            }

            if(a+w < n){
                end = a+w;
            }else{
                end = n-1;
            }

            if(idx > start){
                idx = end + 1;
                continue;
            }

            count += (start - idx) / range;
            if((start - idx) % range != 0){
                count++;
            }


            if(end + 1 < n){
                idx = end + 1;
            }else{
                idx = n;
            }
        }

        count += (n-idx) / range;
        if((n-idx) % range != 0){
            count++;
        }


        return count;
    }
}