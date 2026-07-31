import java.util.*;

class Solution {
    public int solution(int n, int[] lost, int[] reserve) {

        Arrays.sort(lost);
        Arrays.sort(reserve);

        int count = 0;
        int idxL = 0;
        int idxR = 0;

        while(true){

            if(idxL >= lost.length || idxR >= reserve.length){
                break;
            }

            int l = lost[idxL];
            int r = reserve[idxR];

            if(l == 0){
                idxL++;
                continue;
            }
            if(r == 0){
                idxR++;
                continue;
            }

            if(l-1 == r || l+1 == r || l == r){
                count++;
                idxL++;
                reserve[idxR] = 0;
                continue;
            }

            if(l < r){
                idxL++;
            }
            if(l > r){
                idxR++;
            }
        }

        int answer = n - lost.length + count;
        return answer;
    }
}