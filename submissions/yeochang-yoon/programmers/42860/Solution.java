import java.util.*;

class Solution {
    public int solution(String name) {
        int[] arr = new int[26];
        int n = name.length();

        for(int i = 0; i < 26; i++){
            arr[i] = Math.min(i, 26-i);
        }

        int count = 0;
        int count1 = 0;
        for(int i = 0; i < n; i++){
            int a = name.charAt(i) - 'A';
            count += arr[a];
            if(a != 0){
                count1++;
            }
        }

        if(count1 == 0){
            return 0;
        }

        int[] visit = new int[count1];
        int idx = 0;
        for(int i = 0; i < n; i++){
            char c = name.charAt(i);
            if(c != 'A'){
                visit[idx] = i;
                idx++;
            }
        }

        int R = visit[count1-1];
        int L = n-visit[0];
        int min = Math.min(R, L);



        if(count1 > 1){
            int RL = visit[0] * 2 + (n-visit[1]);
            int LR = (n - visit[count1-1]) * 2 + visit[count1-2];

            for(int i = 1; i < idx-1; i++){
                RL = Math.min(RL, visit[i] * 2 + (n - visit[i+1]));
                LR = Math.min(LR, (n - visit[i]) * 2 + visit[i-1]);
            }


            min = Math.min(min, RL);
            min = Math.min(min, LR);
        }


        int answer = count + min;
        return answer;
    }//solution
}