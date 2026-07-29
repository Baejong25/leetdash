import java.util.*;

class Solution {
    public List<Integer> solution(int[] answers) {

        int n = answers.length;

        int[] one = {1, 2, 3, 4, 5};
        int[] two = {2, 1, 2, 3, 2, 4, 2, 5};
        int[] three = {3, 3, 1, 1, 2, 2, 4, 4, 5, 5};

        int onesum = 0;
        int twosum = 0;
        int threesum = 0;

        for(int i = 0; i < n; i++){
            if(one[i % 5] == answers[i]){
                onesum++;
            }
            if(two[i % 8] == answers[i]){
                twosum++;
            }
            if(three[i % 10] == answers[i]){
                threesum++;
            }
        }

        List<Integer> list = new ArrayList<>();

        int maxVal = Math.max(onesum, Math.max(twosum, threesum));

        if(maxVal == onesum){
            list.add(1);
        }
        if(maxVal == twosum){
            list.add(2);
        }
        if(maxVal == threesum){
            list.add(3);
        }


        return list;
    }
}