import java.util.*;

class Solution {
    public int[] solution(int brown, int yellow) {

        int x = 0;
        int y = 0;
        for(int i = 1; i <= yellow; i++){
            if(yellow % i == 0){
                x = i;
                y = yellow/i;
            }

            if(2 * (x+2) + 2*y == brown){
                break;
            }
        }

        int w = Math.max(x, y) + 2;
        int h = Math.min(x, y) + 2;

        int[] answer = {w, h};
        return answer;
    }
}