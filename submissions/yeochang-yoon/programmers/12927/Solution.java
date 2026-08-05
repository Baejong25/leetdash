import java.util.*;

class Solution {
    public long solution(int n, int[] works) {

        int len = works.length;

        if(len == 1){
            works[0] -= n;
            if(works[0] <= 0){
                return 0;
            }else{
                return (long) works[0] * works[0];
            }
        }

        Arrays.sort(works);

        int body = 0;

        for(int i = len-1; i >= 0; i--){
            if(works[len-1] == works[i]){
                body++;
            }else{
                break;
            }
        }

        loop:
        while(n > 0){

            for(int i = 0; i < body; i++){
                if(n <= 0){
                    break loop;
                }
                n--;
                works[len-1-i]--;
            }

            for(int i = len-1-body; i >= 0; i--){
                if(works[len-1] == works[i]){
                    body++;
                }else{
                    break;
                }
            }
        }

        Arrays.sort(works);

        if(works[len-1] <= 0){
            return 0;
        }

        long sum = 0;
        for(int i = 0; i < works.length; i++){
            sum += (long) works[i] * works[i];
        }

        long answer = sum;
        return answer;
    }
}