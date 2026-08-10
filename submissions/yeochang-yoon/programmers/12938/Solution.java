import java.util.*;

class Solution {
    public int[] solution(int n, int s) {

        if(n > s){
            return new int[] {-1};
        }

        int d = s / n;
        int m = s % n;

        int[] result = new int[n];
        Arrays.fill(result, d);

        if(m > 0){
            for(int i = 0; i < m; i++){
                result[n-1-i]++;
            }
        }
        int[] answer = result;
        return answer;
    }
}