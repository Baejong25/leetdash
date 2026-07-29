import java.util.*;

class Solution {
    public int[] solution(int[] array, int[][] commands) {

        int[] answer = new int[commands.length];
        int[] tmp;

        for (int i = 0; i < commands.length; i++) {
            int start = commands[i][0] - 1;
            int end = commands[i][1];
            int k = commands[i][2] - 1;

            tmp = Arrays.copyOfRange(array, start, end);
            Arrays.sort(tmp);
            answer[i] = tmp[k];
        }

        return answer;
    }
}